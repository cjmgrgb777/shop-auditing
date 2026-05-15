const axios = require('axios');
const GATEWAY_URL = 'https://docui.zenith.clinic/api/report/v1.0/report-module/query';
const AUTH_TOKEN = 'DB21821FA6F67C90531C5FA8A2946F7F148B101F2682148DE340C23FD64B2215';

async function test() {
  try {
    const query = 'SELECT email, "createdAt" FROM treatmentplan LIMIT 5';
    const response = await axios.post(GATEWAY_URL, {
      req_method: 'GET',
      query,
      params: []
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(response.data.data));
  } catch (e) {
    console.error(e.message);
  }
}

test();
