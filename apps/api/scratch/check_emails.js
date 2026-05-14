const fs = require('fs');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const GATEWAY_URL = 'https://docui.zenith.clinic/api/report/v1.0/report-module/query';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function run() {
  const csvContent = fs.readFileSync(path.join(__dirname, '../../../emails.csv'), 'utf8');
  const emails = csvContent.split('\n').map(e => e.trim()).filter(e => e);

  const emailListStr = emails.map(e => `'${e.toLowerCase().replace(/'/g, "''")}'`).join(',');

  const query = `
    SELECT LOWER(email) as email, MAX(created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' AS last_login 
    FROM user_login_supply_tracking 
    WHERE LOWER(email) IN (${emailListStr}) 
    GROUP BY LOWER(email);
  `;

  console.log("Running Query against production DB via Gateway...");
  console.log("==================================================");
  
  // We'll output the first few emails of the query to show what we are running
  const printQuery = `
    SELECT LOWER(email) as email, MAX(created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' AS last_login 
    FROM user_login_supply_tracking 
    WHERE LOWER(email) IN (${emails.slice(0, 3).map(e => `'${e}'`).join(',')} ... ${emails.length - 3} more) 
    GROUP BY LOWER(email);
  `;
  console.log(printQuery.trim());
  console.log("==================================================");

  try {
    const response = await axios.post(GATEWAY_URL, {
      req_method: 'GET',
      query: query,
      params: []
    }, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
    });

    const data = response.data?.data || [];
    
    const resultMap = {};
    data.forEach(row => {
      resultMap[row.email] = row.last_login;
    });

    let outputCsv = "last_login_sydney\n";
    emails.forEach(email => {
      let login = resultMap[email.toLowerCase()] || 'Never';
      if (login !== 'Never') {
        // e.g., "2026-05-12T17:49:33.717Z" -> "2026-05-12 17:49:33"
        login = login.replace('T', ' ').substring(0, 19);
      }
      outputCsv += `${login}\n`;
    });

    const outputPath = 'C:\\Users\\garci\\.gemini\\antigravity\\brain\\083b01ba-2e6b-4d1f-9ae9-b6c7c908cf1b\\just_logins.csv';
    fs.writeFileSync(outputPath, outputCsv);
    console.log(`\nSuccess! Wrote ${emails.length} results to ${outputPath}`);
    
    // Print a few sample results
    console.log("\nSample Results:");
    emails.slice(0, 5).forEach(email => {
      console.log(`- ${email}: ${resultMap[email.toLowerCase()] || 'Never'}`);
    });
    
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
