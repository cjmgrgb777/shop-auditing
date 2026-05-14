const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test() {
  const query = `
    SELECT 
        (tp."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as tp_date,
        COUNT(*) as total
    FROM treatmentplan tp
    WHERE (tp."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date >= '2026-04-01'
      AND (tp."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date <= '2026-04-10'
    GROUP BY tp_date
    ORDER BY tp_date;
  `;
  try {
    const res = await axios.post('https://docui.zenith.clinic/api/report/v1.0/report-module/query', { req_method: 'GET', query, params: [] }, { headers: { 'Authorization': `Bearer ${process.env.AUTH_TOKEN}` } });
    console.log(res.data?.data);
  } catch (err) {
    console.error(err.message);
  }
}
test();
