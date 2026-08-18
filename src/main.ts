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

function parseInput(raw: string): string {
    let description = raw.trim();
    let dueDate: string | null = null;

    // extract date
    const dateIndex = description.indexOf('>');
    if (dateIndex !== -1) {
        const datePart = description.slice(dateIndex + 1).trim();
        description = description.slice(0, dateIndex).trim();
        dueDate = parseDate(datePart);
    }
    
    // extract tags
    const tags = description.match(/#\S+/g) ?? [];
    description = description.replace(/#\S+/g, '').trim();

    // separate tags
    const priorityTags = tags.filter(t => /^#p\d+$/.test(t));
    const otherTags = tags.filter(t => !/^#p\d+$/.test(t));

    // rebuild
    const parts = [description, ...otherTags, ...priorityTags].filter(p => p.length > 0);
    let line = `- [ ] ${parts.join(' ')}`;
    if (dueDate) line += ` ${DATE_EMOJI} ${dueDate}`;
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
            cls: 'jotline-input', // see styles.css, sets width to 100%
        });
        input.focus();

        // Preview of parsed task
        const preview = contentEl.createDiv({ cls: 'jotline-preview' });

        // Update preview on every keystroke
        const updatePreview = () => {
            const text = input.value.trim();
            preview.setText(text.length > 0 ? parseInput(text) : '');
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
        const line = parseInput(text);
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