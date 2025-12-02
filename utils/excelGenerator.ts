import * as XLSX from 'xlsx';
import { Task } from '../types';

export const exportToExcel = (tasks: Task[]) => {
  const completedTasks = tasks.filter(t => t.result);

  if (completedTasks.length === 0) {
    alert("No completed tasks to export.");
    return;
  }

  // Flatten data for Excel
  const data = completedTasks.map(task => {
    const hotel = task.result!;
    return {
      'URL': task.url,
      'Hotel Name': hotel.name,
      'Address': hotel.address,
      'Rating': hotel.rating,
      'Price': hotel.price,
      'Image Count': hotel.images.length,
      'First Image': hotel.images[0] || '',
      'All Images (Comma Separated)': hotel.images.join(', '),
      'Status': task.status,
      'Crawl Time': task.finishedAt ? new Date(task.finishedAt).toLocaleString() : ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hotel Data");

  // Force UTF-8 with BOM for Excel compatibility
  const wopts: XLSX.WritingOptions = { bookType: 'xlsx', bookSST: false, type: 'array' };
  const wbout = XLSX.write(workbook, wopts);
  
  // Add BOM manually if needed, though xlsx library handles modern excel well.
  // We will create a Blob with the buffer.
  const blob = new Blob([wbout], {type: "application/octet-stream"});

  // Create download link
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking_crawl_result_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};