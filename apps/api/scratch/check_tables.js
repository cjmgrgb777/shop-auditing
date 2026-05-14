const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test() {
  const query = "SELECT * FROM patientorder LIMIT 1;";
  try {
    const res = await axios.post('https://docui.zenith.clinic/api/report/v1.0/report-module/query', { req_method: 'GET', query, params: [] }, { headers: { 'Authorization': `Bearer ${process.env.AUTH_TOKEN}` } });
    console.log(res.data?.data);
  } catch (err) {
    console.error(err.message);
  }
}
test();
