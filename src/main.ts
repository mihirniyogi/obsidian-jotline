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

    const dateIndex = description.indexOf('>');
    if (dateIndex !== -1) {
        const datePart = description.slice(dateIndex + 1).trim();
        description = description.slice(0, dateIndex).trim();
        dueDate = parseDate(datePart);
    }
    
    let line = `- [ ] ${description}`;
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

export default class QuickTaskPlugin extends Plugin {
	async onload() {
        this.addCommand({
            id: "open-quick-capture",
            name: "Quick capture task",
            callback: () => {
                new QuickTaskModal(this.app).open();
            }
        });
	}
}

class QuickTaskModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Quick Task' });

        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: "Type your task here and press Enter",
            cls: 'quick-capture-input', // see styles.css, sets width to 100%
        });
        input.focus();
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const text = input.value.trim();
                if (text.length > 0) {
                    this.appendTask(text)
                        .then(() => this.close())
                        .catch((err) => {
                            console.error('Quick task failed:', err);
                            new Notice('Failed to capture task');
                        });
                } else {
                    this.close();
                }
            } else if (event.key === 'Escape') {
                this.close();
            }
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
        new Notice("Task captured!");
    }

    onClose() {
        this.contentEl.empty();
    }
}