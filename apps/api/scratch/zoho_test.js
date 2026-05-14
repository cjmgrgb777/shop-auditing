const axios = require('axios');

async function test() {
  try {
    const tokenRes = await axios.post('https://accounts.zoho.com.au/oauth/v2/token', null, {
      params: {
        client_id: '1000.OUEWDY1AIJJNH4FGCLIYXO60NZ5IRT',
        client_secret: '469559ddbedde84e56f8acf754ab138b0e9f7b160f',
        refresh_token: '1000.4af6a89bc8438359680a103c07d0d45f.26c90d693ae24f58073f63aed4309551',
        grant_type: 'refresh_token'
      }
    });
    
    const token = tokenRes.data.access_token;
    
    const res = await axios.post('https://www.zohoapis.com.au/crm/v6/coql', {
      select_query: "select Email, Supply_Date_1, Order_Date from Contacts where Email = 'jsherratt1995@gmail.com'"
    }, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    
    console.log('COQL data:', JSON.stringify(res.data, null, 2));
  } catch(e) { 
    console.error('Error:', e.response?.data || e.message); 
  }
}
test();
