import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createSample() {
  const workbook = new ExcelJS.Workbook();

  const sheet1 = workbook.addWorksheet('Login Tests');
  sheet1.addRow(['Test Name', 'Steps', 'Input', 'Expected Output']);
  sheet1.addRow([
    'Open Example Domain',
    'Go to the website and check that the page loads correctly with the heading visible.',
    'URL: https://example.com',
    'The page should show "Example Domain" as the main heading.',
  ]);
  sheet1.addRow([
    'Search on DuckDuckGo',
    'Open the search engine, type a search query in the search box, and press enter to search.',
    'URL: https://duckduckgo.com, Search: playwright automation',
    'Search results should appear showing pages related to playwright automation.',
  ]);

  const sheet2 = workbook.addWorksheet('Form Tests');
  sheet2.addRow(['Test Name', 'Steps', 'Input', 'Expected Output']);
  sheet2.addRow([
    'Wikipedia Search',
    'Navigate to Wikipedia, find the search box, enter a topic name, and click the search button.',
    'URL: https://www.wikipedia.org, Topic: Automation testing',
    'The Wikipedia page for automation testing should open or search results should be shown.',
  ]);

  const columns = ['A', 'B', 'C', 'D'];
  for (const sheet of workbook.worksheets) {
    for (const col of columns) {
      sheet.getColumn(col).width = 30;
    }
    sheet.getRow(1).font = { bold: true };
  }

  const outputPath = path.join(__dirname, 'sample_test_cases.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Sample file created: ${outputPath}`);
}

createSample().catch(console.error);
