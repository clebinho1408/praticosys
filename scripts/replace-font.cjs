const fs = require('fs');
const files = [
  'pages/Reports.tsx',
  'src/components/reports/CnhReports.tsx',
  'src/components/reports/PcdReports.tsx',
  'src/components/reports/CfcReports.tsx',
  'pages/SchedulingCenter.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/font-black/g, 'font-bold');
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
