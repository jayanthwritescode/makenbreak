// src/types.ts
export interface Cell {
  value: string;
  formula?: string;
}

export interface SpreadsheetData {
  [key: string]: Cell; // key like 'A1', 'B2'
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { row: number; col: number };
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}
