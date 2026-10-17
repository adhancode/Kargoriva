// ============ Ekonomi: buku transaksi pembayaran & setoran ============

export interface LedgerEntry {
  id: string;
  kind: 'payment' | 'deposit';
  amount: number;
  label: string;
}

export class Economy {
  entries: LedgerEntry[] = [];
  private seq = 0;

  reset(): void {
    this.entries = [];
    this.seq = 0;
  }

  recordPayment(customerId: string, customerName: string, amount: number): void {
    this.entries.push({
      id: `tx-${++this.seq}`,
      kind: 'payment',
      amount,
      label: `Pembayaran ${customerName} (${customerId})`,
    });
  }

  recordDeposit(amount: number): void {
    this.entries.push({
      id: `tx-${++this.seq}`,
      kind: 'deposit',
      amount,
      label: 'Setoran ke DC',
    });
  }

  totalCustomerPayments(): number {
    return this.entries.filter(e => e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
  }

  totalDeposited(): number {
    return this.entries.filter(e => e.kind === 'deposit').reduce((s, e) => s + e.amount, 0);
  }

  reconcile(): { expected: number; received: number; deposited: number; discrepancy: number } {
    const received = this.totalCustomerPayments();
    const deposited = this.totalDeposited();
    return { expected: received, received, deposited, discrepancy: deposited - received };
  }
}

