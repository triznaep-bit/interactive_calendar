/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isRussianHoliday } from '../utils';

/**
 * Returns the shifted date for salary or advance under TK RF (Article 136).
 * If the payment day falls on a weekend or a non-working holiday, the payment is made on the preceding working day.
 */
export function getShiftedPaymentDate(year: number, monthIndex: number, targetDay: number): Date {
  const date = new Date(year, monthIndex, targetDay);
  
  // We keep shifting backwards if it falls on Saturday, Sunday, or a Russian Holiday.
  while (true) {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = isRussianHoliday(date);
    
    if (isWeekend || isHoliday) {
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }
  return date;
}
