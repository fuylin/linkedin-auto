'use client';
import { useState, useEffect } from 'react';

export default function LocalTime({ date }) {
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    if (date) {
      const d = new Date(date);
      setFormatted(isNaN(d.getTime()) ? '' : d.toLocaleString());
    }
  }, [date]);

  if (!date) return <span>Not scheduled</span>;
  return <span>{formatted}</span>;
}
