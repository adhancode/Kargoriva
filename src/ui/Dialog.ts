export interface DialogChoice { label: string; onPick?: () => void; }
export interface DialogStep { speaker: string; portrait?: string; text: string; choices?: DialogChoice[]; }

/** Dialog typewriter sederhana; klik/Enter mempercepat teks lalu maju ke langkah berikutnya. */
export class DialogManager {
  open = false; private steps: DialogStep[] = []; private index = 0; private elapsed = 0; private shown = 0; private closeCallback?: () => void; private allowSkip = false; private screen: HTMLElement; private textEl: HTMLElement; private nameEl: HTMLElement; private choicesEl: HTMLElement; private portrait: HTMLCanvasElement;
  constructor() {
    this.screen = document.getElementById('screen-dialog')!; this.textEl = document.getElementById('dialog-text')!; this.nameEl = document.getElementById('dialog-name')!; this.choicesEl = document.getElementById('dialog-choices')!; this.portrait = document.getElementById('dialog-portrait') as HTMLCanvasElement;
    this.screen.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; this.advance(); });
  }
  show(steps: DialogStep[], onClose?: () => void, allowSkip = false): void { this.steps = steps; this.index = 0; this.elapsed = 0; this.shown = 0; this.closeCallback = onClose; this.allowSkip = allowSkip; this.open = steps.length > 0; this.render(); }
  update(dt: number): void { if (!this.open) return; this.elapsed += dt; this.shown = Math.min(this.current.text.length, Math.floor(this.elapsed * 52)); this.textEl.textContent = this.current.text.slice(0, this.shown); }
  handleKey(_code: string): void { this.advance(); }
  close(): void { if (!this.open) return; this.open = false; this.screen.classList.remove('active'); const done = this.closeCallback; this.closeCallback = undefined; done?.(); }
  private get current(): DialogStep { return this.steps[this.index]; }
  private render(): void {
    if (!this.open) return; const step = this.current; this.screen.classList.add('active'); this.nameEl.textContent = step.speaker; this.textEl.textContent = ''; this.elapsed = 0; this.shown = 0; this.choicesEl.innerHTML = '';
    const ctx = this.portrait.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, this.portrait.width, this.portrait.height); const colors: Record<string,string> = { manager:'#415166', sorter:'#3d886d', customer:'#487ea3', cashier:'#927546', kurir:'#ce6d3d' }; ctx.fillStyle = colors[step.portrait ?? ''] ?? '#46515c'; ctx.fillRect(0,0,130,130); ctx.fillStyle = '#f4c7a0'; ctx.beginPath(); ctx.arc(65,47,24,0,Math.PI*2); ctx.fill(); ctx.fillStyle = '#22303b'; ctx.fillRect(35,76,60,50); ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText(step.portrait ?? 'NPC',65,119); }
    if (step.choices?.length) step.choices.forEach((choice, i) => { const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = (i + 1) + '. ' + choice.label; b.addEventListener('click', e => { e.stopPropagation(); choice.onPick?.(); this.advance(); }); this.choicesEl.appendChild(b); });
    else { const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = 'Lanjutkan  ›'; b.addEventListener('click', e => { e.stopPropagation(); this.advance(); }); this.choicesEl.appendChild(b); }
    if (this.allowSkip) { const b = document.createElement('button'); b.className = 'btn ghost dialog-skip'; b.textContent = 'Lewati'; b.addEventListener('click', e => { e.stopPropagation(); this.close(); }); this.choicesEl.appendChild(b); }
  }
  private advance(): void { if (!this.open) return; if (this.shown < this.current.text.length) { this.shown = this.current.text.length; this.textEl.textContent = this.current.text; return; } if (this.index + 1 < this.steps.length) { this.index++; this.render(); } else this.close(); }
}

