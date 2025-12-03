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
      'City': hotel.cityName || '',
      'Region': hotel.regionName || '',
      'Country': hotel.countryName || '',
      'Rating': hotel.rating,
      'Rating Category': hotel.ratingCategory || '',
      'Review Count': hotel.reviewCount || '',
      'About': hotel.about || '',
      'Facilities': hotel.facilities?.join(', ') || '',
      'Check-in': hotel.houseRules?.checkIn || '',
      'Check-out': hotel.houseRules?.checkOut || '',
      'Pets': hotel.houseRules?.pets || '',
      'FAQs': hotel.faqs?.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n') || '',
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

export const exportToJSON = (tasks: Task[]) => {
  const completedTasks = tasks.filter(t => t.result);

  if (completedTasks.length === 0) {
    alert("No completed tasks to export.");
    return;
  }

  // Export full task data with results
  const data = completedTasks.map(task => ({
    url: task.url,
    status: task.status,
    crawledAt: task.finishedAt ? new Date(task.finishedAt).toISOString() : null,
    result: task.result
  }));

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Create download link
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking_crawl_result_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  window.URL.revokeObjectURL(url);
};