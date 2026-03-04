export interface Console {
  id: string;
  name: string;
  type: 'PS3' | 'PS4' | 'PS5';
  status: 'available' | 'playing' | 'finished';
  startTime?: number;
  endTime?: number;
  durationMinutes?: number; // if null, it's open-ended
  hourlyRate: number;
  customerName?: string;
  relayId: number;
}

export interface RentalHistory {
  id: string;
  consoleId: string;
  consoleName: string;
  customerName: string;
  startTime: number;
  endTime: number;
  totalDurationMinutes: number;
  totalCost: number; // Rental only
  fnbCost: number;
  totalBill: number;
  hourlyRate: number;
}

export interface Product {
  id: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  timestamp: number;
  consoleId?: string; // Optional: link to a console session
  customerName?: string;
  isPaid?: boolean;
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  role: 'admin' | 'staff';
}

export interface Settings {
  rates: {
    PS3: number;
    PS4: number;
    PS5: number;
  };
  relayBaseUrl: string;
}
