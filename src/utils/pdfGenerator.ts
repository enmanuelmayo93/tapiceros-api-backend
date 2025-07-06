import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  businessInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone: string;
    email: string;
    logo?: string;
  };
  clientInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    email: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
}

export interface ReceiptData {
  receiptNumber: string;
  date: Date;
  businessInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    phone: string;
    email: string;
    logo?: string;
  };
  clientInfo: {
    name: string;
    email: string;
  };
  items: Array<{
    description: string;
    amount: number;
  }>;
  total: number;
  currency: string;
  paymentMethod: string;
  transactionId?: string;
}

export class PDFGenerator {
  private doc: PDFDocument;
  private yPosition: number = 100;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });
  }

  // Generate invoice PDF
  async generateInvoice(data: InvoiceData, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      this.doc.pipe(stream);

      try {
        this.createInvoiceHeader(data);
        this.createInvoiceBody(data);
        this.createInvoiceFooter(data);

        this.doc.end();

        stream.on('finish', () => {
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate receipt PDF
  async generateReceipt(data: ReceiptData, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      this.doc.pipe(stream);

      try {
        this.createReceiptHeader(data);
        this.createReceiptBody(data);
        this.createReceiptFooter(data);

        this.doc.end();

        stream.on('finish', () => {
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private createInvoiceHeader(data: InvoiceData): void {
    // Business logo and info
    if (data.businessInfo.logo) {
      try {
        this.doc.image(data.businessInfo.logo, 50, 50, { width: 100 });
        this.yPosition = 160;
      } catch (error) {
        console.warn('Could not load logo:', error);
        this.yPosition = 100;
      }
    }

    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, this.yPosition);

    this.yPosition += 40;

    // Business information
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.businessInfo.name, 50, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.businessInfo.address, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`${data.businessInfo.city}, ${data.businessInfo.state} ${data.businessInfo.postalCode}`, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(data.businessInfo.country, 50, this.yPosition);

    this.yPosition += 20;

    this.doc.text(`Phone: ${data.businessInfo.phone}`, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`Email: ${data.businessInfo.email}`, 50, this.yPosition);

    // Invoice details (right side)
    const rightX = 350;
    let rightY = 100;

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Invoice Details', rightX, rightY);

    rightY += 25;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${data.invoiceNumber}`, rightX, rightY);

    rightY += 15;

    this.doc.text(`Date: ${data.date.toLocaleDateString()}`, rightX, rightY);

    rightY += 15;

    this.doc.text(`Due Date: ${data.dueDate.toLocaleDateString()}`, rightX, rightY);

    // Client information
    this.yPosition = Math.max(this.yPosition + 40, rightY + 40);

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Bill To:', 50, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.clientInfo.name, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(data.clientInfo.address, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`${data.clientInfo.city}, ${data.clientInfo.state} ${data.clientInfo.postalCode}`, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(data.clientInfo.country, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`Email: ${data.clientInfo.email}`, 50, this.yPosition);

    this.yPosition += 40;
  }

  private createInvoiceBody(data: InvoiceData): void {
    // Items table header
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Description', 50, this.yPosition)
      .text('Qty', 300, this.yPosition)
      .text('Unit Price', 350, this.yPosition)
      .text('Total', 450, this.yPosition);

    this.yPosition += 20;

    // Separator line
    this.doc
      .moveTo(50, this.yPosition)
      .lineTo(550, this.yPosition)
      .stroke();

    this.yPosition += 20;

    // Items
    data.items.forEach((item) => {
      this.doc
        .fontSize(10)
        .font('Helvetica')
        .text(item.description, 50, this.yPosition, { width: 240 })
        .text(item.quantity.toString(), 300, this.yPosition)
        .text(`${data.currency} ${item.unitPrice.toFixed(2)}`, 350, this.yPosition)
        .text(`${data.currency} ${item.total.toFixed(2)}`, 450, this.yPosition);

      this.yPosition += 20;
    });

    // Separator line
    this.doc
      .moveTo(50, this.yPosition)
      .lineTo(550, this.yPosition)
      .stroke();

    this.yPosition += 20;

    // Totals
    const totalsX = 400;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal:', totalsX, this.yPosition)
      .text(`${data.currency} ${data.subtotal.toFixed(2)}`, 450, this.yPosition);

    this.yPosition += 20;

    this.doc
      .text('Tax:', totalsX, this.yPosition)
      .text(`${data.currency} ${data.tax.toFixed(2)}`, 450, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Total:', totalsX, this.yPosition)
      .text(`${data.currency} ${data.total.toFixed(2)}`, 450, this.yPosition);

    this.yPosition += 40;
  }

  private createInvoiceFooter(data: InvoiceData): void {
    // Notes
    if (data.notes) {
      this.doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Notes:', 50, this.yPosition);

      this.yPosition += 20;

      this.doc
        .fontSize(10)
        .font('Helvetica')
        .text(data.notes, 50, this.yPosition, { width: 500 });

      this.yPosition += 40;
    }

    // Terms
    if (data.terms) {
      this.doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Terms & Conditions:', 50, this.yPosition);

      this.yPosition += 20;

      this.doc
        .fontSize(10)
        .font('Helvetica')
        .text(data.terms, 50, this.yPosition, { width: 500 });

      this.yPosition += 40;
    }

    // Footer
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .text('Thank you for your business!', 50, this.yPosition, { align: 'center' });
  }

  private createReceiptHeader(data: ReceiptData): void {
    // Business logo and info
    if (data.businessInfo.logo) {
      try {
        this.doc.image(data.businessInfo.logo, 50, 50, { width: 80 });
        this.yPosition = 140;
      } catch (error) {
        console.warn('Could not load logo:', error);
        this.yPosition = 100;
      }
    }

    this.doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('RECEIPT', 50, this.yPosition);

    this.yPosition += 30;

    // Business information
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.businessInfo.name, 50, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.businessInfo.address, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`${data.businessInfo.city}, ${data.businessInfo.state}`, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(data.businessInfo.country, 50, this.yPosition);

    this.yPosition += 20;

    this.doc.text(`Phone: ${data.businessInfo.phone}`, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`Email: ${data.businessInfo.email}`, 50, this.yPosition);

    // Receipt details (right side)
    const rightX = 350;
    let rightY = 100;

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Receipt Details', rightX, rightY);

    rightY += 25;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Receipt #: ${data.receiptNumber}`, rightX, rightY);

    rightY += 15;

    this.doc.text(`Date: ${data.date.toLocaleDateString()}`, rightX, rightY);

    rightY += 15;

    this.doc.text(`Time: ${data.date.toLocaleTimeString()}`, rightX, rightY);

    if (data.transactionId) {
      rightY += 15;
      this.doc.text(`Transaction ID: ${data.transactionId}`, rightX, rightY);
    }

    // Client information
    this.yPosition = Math.max(this.yPosition + 30, rightY + 30);

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Customer:', 50, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.clientInfo.name, 50, this.yPosition);

    this.yPosition += 15;

    this.doc.text(`Email: ${data.clientInfo.email}`, 50, this.yPosition);

    this.yPosition += 30;
  }

  private createReceiptBody(data: ReceiptData): void {
    // Items table header
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Description', 50, this.yPosition)
      .text('Amount', 450, this.yPosition);

    this.yPosition += 20;

    // Separator line
    this.doc
      .moveTo(50, this.yPosition)
      .lineTo(550, this.yPosition)
      .stroke();

    this.yPosition += 20;

    // Items
    data.items.forEach((item) => {
      this.doc
        .fontSize(10)
        .font('Helvetica')
        .text(item.description, 50, this.yPosition, { width: 380 })
        .text(`${data.currency} ${item.amount.toFixed(2)}`, 450, this.yPosition);

      this.yPosition += 20;
    });

    // Separator line
    this.doc
      .moveTo(50, this.yPosition)
      .lineTo(550, this.yPosition)
      .stroke();

    this.yPosition += 20;

    // Total
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Total:', 400, this.yPosition)
      .text(`${data.currency} ${data.total.toFixed(2)}`, 450, this.yPosition);

    this.yPosition += 30;

    // Payment method
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Payment Method: ${data.paymentMethod}`, 50, this.yPosition);

    this.yPosition += 40;
  }

  private createReceiptFooter(data: ReceiptData): void {
    // Footer
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .text('Thank you for your payment!', 50, this.yPosition, { align: 'center' });

    this.yPosition += 20;

    this.doc
      .text('This receipt serves as proof of payment.', 50, this.yPosition, { align: 'center' });
  }

  // Helper method to create uploads directory if it doesn't exist
  static ensureUploadsDirectory(): string {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    return uploadsDir;
  }

  // Generate unique filename
  static generateFilename(prefix: string, extension: string = 'pdf'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }
}

// Export convenience functions
export const generateInvoicePDF = async (data: InvoiceData): Promise<string> => {
  const uploadsDir = PDFGenerator.ensureUploadsDirectory();
  const filename = PDFGenerator.generateFilename('invoice');
  const filepath = path.join(uploadsDir, filename);
  
  const generator = new PDFGenerator();
  return await generator.generateInvoice(data, filepath);
};

export const generateReceiptPDF = async (data: ReceiptData): Promise<string> => {
  const uploadsDir = PDFGenerator.ensureUploadsDirectory();
  const filename = PDFGenerator.generateFilename('receipt');
  const filepath = path.join(uploadsDir, filename);
  
  const generator = new PDFGenerator();
  return await generator.generateReceipt(data, filepath);
}; 