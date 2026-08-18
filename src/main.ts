import {
    App,
	Modal,
	Notice,
	Plugin,
    TFile,
} from 'obsidian';

const DATE_EMOJI = '📅';
const DATE_FORMAT = 'YYYY-MM-DD';
const INBOX_FILE = 'tasks.md';

// ---- Parsing ----

interface ParsedTask {
    description: string;
    otherTags: string[];
    priorityTag: string | null;
    rawDate: string | null; // what user typed after '>'
    dueDate: string | null; // resolved ISO date in YYYY-MM-DD
} 

function parseTask(raw: string): ParsedTask {
    let description = raw.trim();
    let rawDate: string | null = null;
    let dueDate: string | null = null;

    // extract date
    const dateIndex = description.indexOf('>');
    if (dateIndex !== -1) {
        rawDate = description.slice(dateIndex + 1).trim();
        description = description.slice(0, dateIndex).trim();
        dueDate = parseDate(rawDate);
    }
    
    // extract tags
    const allTags = description.match(/#\S+/g) ?? []; // matches anything like #tag
    description = description.replace(/#\S+/g, '').trim(); // removes them

    // separate tags
    const priorityTag = allTags.find(t => /^#p\d+$/.test(t)) ?? null; // matches #p1, #p2, etc.
    const otherTags = allTags.filter(t => !/^#p\d+$/.test(t)); // matches all other tags

    // rebuild
    return {
        description,
        otherTags,
        priorityTag,
        rawDate: rawDate && rawDate.length > 0 ? rawDate : null,
        dueDate,
    }
}

function formatTask(parsed: ParsedTask): string {
    const tagParts = [...parsed.otherTags];
    if (parsed.priorityTag) tagParts.push(parsed.priorityTag);

    const parts = [...tagParts, parsed.description].filter(p => p.length > 0);
    let line = `- [ ] ${parts.join(' ')}`;
    if (parsed.dueDate) line += ` ${DATE_EMOJI} ${parsed.dueDate}`;
    return line;
}

function parseDate(raw: string): string | null {
    const s = raw.trim().toLowerCase();
    const today = window.moment().startOf('day');

    // Tier 1: relative keywords
    if (s === 'tdy' || s === 'today') return today.format(DATE_FORMAT);
    if (s === 'tmr' || s === 'tmrw' || s === 'tomorrow') return today.add(1, 'day').format(DATE_FORMAT);
    if (s === 'yest' || s === 'yesterday') return today.subtract(1, 'day').format(DATE_FORMAT);

    // Tier 2: weekday names -> next occurence
    const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const fullDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let dayIndex = fullDays.indexOf(s);
    if (dayIndex === -1) dayIndex = shortDays.indexOf(s);
    if (dayIndex !== -1) {
        const target = window.moment().day(dayIndex);
        if (target.isSameOrBefore(today)) target.add(1, 'week');
        return target.format(DATE_FORMAT);
    }

    // Tier 3: explicit date formats a: "2 aug"; b: "2 august"; c: ISO format "2023-08-02"
    const parsed = window.moment(s, ['D MMM', 'D MMMM', 'YYYY-MM-DD'], true);
    if (parsed.isValid()) return parsed.format(DATE_FORMAT);

    // No matches
    return null;
}

// ---- Plugin ----

export default class JotlinePlugin extends Plugin {
	async onload() {
        this.addCommand({
            id: "add-task",
            name: "Add task",
            callback: () => {
                new JotlineModal(this.app).open();
            }
        });
	}
}

class JotlineModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        
        // Title
        contentEl.createEl('h3', { text: 'Jotline' });

        // Input for task
        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: "Type your task here and press Enter",
            cls: 'jotline-input',
        });
        input.focus();

        // Field indicator chips
        const chipRow = contentEl.createDiv({ cls: 'jotline-chips' });
        const chips = {
            description: chipRow.createSpan({ text: 'Description', cls: 'jotline-chip' }),
			course: chipRow.createSpan({ text: 'Course', cls: 'jotline-chip' }),
			priority: chipRow.createSpan({ text: 'Priority', cls: 'jotline-chip' }),
			due: chipRow.createSpan({ text: 'Due', cls: 'jotline-chip' }),
		};

        // Preview of parsed task
        const preview = contentEl.createDiv({ cls: 'jotline-preview' });

        // Update chips + preview on every keystroke
        const updatePreview = () => {
            const text = input.value.trim();

            if (text.length === 0) {
                preview.setText('');
                Object.values(chips).forEach(chip => chip.removeClass('active'));
                chips.priority.removeClass('p1', 'p2', 'p3');
                return;
            }
            
            const parsed = parseTask(text);

            // light up chips based on what's present
            chips.description.toggleClass('active', parsed.description.length > 0);
			chips.course.toggleClass('active', parsed.otherTags.length > 0);
			chips.priority.toggleClass('active', parsed.priorityTag !== null);
			chips.due.toggleClass('active', parsed.dueDate !== null);

            // colour priority chip by level
            chips.priority.removeClass('p1', 'p2', 'p3');
			if (parsed.priorityTag) {
				const level = parsed.priorityTag.replace('#', ''); // "p1"
				chips.priority.addClass(level);
			}

            // show resolved date on due chip
            chips.due.setText(parsed.dueDate ? `Due: ${parsed.dueDate}` : 'Due');

            // remove '- [ ]' prefix
            const finalText = formatTask(parsed).replace(/^- \[ \] /, '');
            
            preview.setText(finalText);
        };

        updatePreview(); // run once on open
        input.addEventListener('input', updatePreview); // run on every keystroke

        // Handle 'Enter' and 'Escape' keys
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.close();
                return;
            }

            if (event.key !== 'Enter') return;

            const text = input.value.trim();
            if (text.length === 0) {
                new Notice('Task cannot be empty');
                return;
            }

            this.appendTask(text)
                .then(() => this.close())
                .catch((err) => {
                    console.error('Failed to add task:', err);
                    new Notice('Failed to add task');
                });
        });
    }

    async appendTask(text: string) {
        const line = formatTask(parseTask(text));
        const file = this.app.vault.getAbstractFileByPath(INBOX_FILE);
        if (file instanceof TFile) {
            const existing = await this.app.vault.read(file);
            const separator = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
            await this.app.vault.modify(file, existing + separator + line + '\n');
        } else {
            await this.app.vault.create(INBOX_FILE, line + '\n');
        }
        new Notice("Task added!");
    }

    onClose() {
        this.contentEl.empty();
    }
}