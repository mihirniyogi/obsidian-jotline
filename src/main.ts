import {
    App,
	Modal,
	Notice,
	Plugin,
    TFile,
} from 'obsidian';

const INBOX_FILE = 'tasks.md';

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
        contentEl.createEl('h3', { text: 'Quick Capture' });

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
                            console.error('Quick capture failed:', err);
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
        const line = `- [ ] ${text}`;
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