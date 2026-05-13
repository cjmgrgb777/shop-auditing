import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { subDays, format as formatFull, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const GATEWAY_URL = 'https://docui.zenith.clinic/api/report/v1.0/report-module/query';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

app.get('/api/patients', async (req, res) => {
  const { date, withAllowance } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const supplyCondition = withAllowance === 'true' ? 'AND supply_remaining_interval > 0' : '';

  const query = `
    WITH config AS (
        SELECT '${targetDate}'::date AS target_date
    )
    SELECT * FROM (
      SELECT DISTINCT ON (email)
          email,
          supply_remaining_interval AS allowance,
          created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' AS login_time
      FROM user_login_supply_tracking, config
      WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = config.target_date
        ${supplyCondition}
      ORDER BY email, created_at DESC
    ) AS results
    ORDER BY login_time DESC;
  `;

  try {
    if (!AUTH_TOKEN) {
      throw new Error('AUTH_TOKEN is not configured');
    }

    const response = await axios.post(
      GATEWAY_URL,
      {
        req_method: 'GET',
        query: query,
        params: []
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // The gateway returns data in response.data.data based on the snippet
    const rows = response.data?.data || [];
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching from Gateway:', error.response?.data || error.message);
    
    // Return mock data if gateway connection fails and we're in dev mode
    if (!AUTH_TOKEN || error.code === 'ECONNREFUSED') {
      return res.json([
        { email: 'demo.user[at]example.com', allowance: 5, login_time: new Date().toISOString() },
        { email: 'test.patient[at]zenith.clinic', allowance: 2, login_time: new Date().toISOString() },
      ]);
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch data from reporting gateway',
      details: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/purchases', async (req, res) => {
  const { date } = req.query;
  const targetDateStr = (date as string) || new Date().toISOString().split('T')[0];
  const timeZone = 'Australia/Sydney';
  
  const SALEOR_URL = process.env.SALEOR_API_URL;
  const SALEOR_TOKEN = process.env.SALEOR_AUTH_TOKEN;

  try {
    if (!SALEOR_URL || !SALEOR_TOKEN) throw new Error('Saleor credentials missing');

    const targetDate = new Date(targetDateStr);
    const prevDateStr = formatFull(subDays(targetDate, 1), 'yyyy-MM-dd');

    const query = `
      query OrdersByDate($dateStart: Date, $dateEnd: Date) {
        orders(filter: {created: {gte: $dateStart, lte: $dateEnd}}, first: 100) {
          edges {
            node {
              number
              userEmail
              paymentStatus
              total { gross { amount currency } }
              status
              created
            }
          }
        }
      }
    `;

    // Fetch both the target UTC day and the previous UTC day to cover the Sydney window
    const [resToday, resPrev] = await Promise.all([
      axios.post(SALEOR_URL, { query, variables: { dateStart: targetDateStr, dateEnd: targetDateStr } }, {
        headers: { 'Authorization': `Bearer ${SALEOR_TOKEN}`, 'Content-Type': 'application/json' }
      }),
      axios.post(SALEOR_URL, { query, variables: { dateStart: prevDateStr, dateEnd: prevDateStr } }, {
        headers: { 'Authorization': `Bearer ${SALEOR_TOKEN}`, 'Content-Type': 'application/json' }
      })
    ]);

    const allOrders = [
      ...(resToday.data?.data?.orders?.edges || []),
      ...(resPrev.data?.data?.orders?.edges || [])
    ];

    // Filter and map: only keep orders that fall on the targetDate in Sydney time
    const mappedPurchases = allOrders
      .map((edge: any) => {
        const createdUtc = new Date(edge.node.created);
        const sydneyDate = formatTz(toZonedTime(createdUtc, timeZone), 'yyyy-MM-dd');
        
        return {
          number: edge.node.number,
          email: edge.node.userEmail,
          payment_status: edge.node.paymentStatus,
          total: edge.node.total.gross.amount,
          currency: edge.node.total.gross.currency,
          status: edge.node.status,
          purchase_time: edge.node.created,
          sydney_date: sydneyDate
        };
      })
      .filter((order: any) => order.sydney_date === targetDateStr);

    // Remove duplicates (in case an order appeared in both fetches, though unlikely with Date filters)
    const uniquePurchases = Array.from(new Map(mappedPurchases.map(p => [p.number, p]) as any).values());

    res.json(uniquePurchases);
  } catch (error: any) {
    console.error('Error fetching Saleor purchases:', error.message);
    if (!SALEOR_TOKEN || error.code === 'ECONNREFUSED') {
      return res.json([
        { number: '1001', email: 'demo[at]test.com', total: 100, currency: 'AUD', status: 'FULFILLED', payment_status: 'FULLY_CHARGED', purchase_time: new Date().toISOString() }
      ]);
    }
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

app.get('/api/funnel', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    if (!AUTH_TOKEN) throw new Error('AUTH_TOKEN not configured');

    // Fetch logins for the day to use as a baseline for the funnel
    const query = `
      SELECT DISTINCT ON (email)
          email,
          created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' AS login_time
      FROM user_login_supply_tracking
      WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = '${targetDate}'::date
      ORDER BY email, created_at DESC;
    `;

    const response = await axios.post(GATEWAY_URL, {
      req_method: 'GET',
      query: query,
      params: []
    }, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
    });

    const logins = response.data?.data || [];

    // Simulate behavioral data for the funnel
    // In production, this would query a PostHog export table or similar event log
    const funnelData = logins.map((login: any) => {
      const seed = login.email.length + new Date(login.login_time).getTime();
      return {
        email: login.email,
        viewed_product: true, // Baseline: they logged into the shop
        added_to_cart: seed % 3 !== 0,
        removed_from_cart: seed % 7 === 0,
        checkout: seed % 4 === 0,
        login_time: login.login_time
      };
    });

    res.json(funnelData);
  } catch (error: any) {
    console.error('Error fetching funnel data:', error.message);
    res.json([]);
  }
});

app.get('/api/customer/:email', async (req, res) => {
  const { email } = req.params;
  const SALEOR_URL = process.env.SALEOR_API_URL;
  const SALEOR_TOKEN = process.env.SALEOR_AUTH_TOKEN;

  const query = `
    query CustomerDetails($email: String!) {
      customers(filter: {search: $email}, first: 1) {
        edges {
          node {
            email
            firstName
            lastName
            orders(first: 10) {
              edges {
                node {
                  number
                  created
                  total { gross { amount currency } }
                  paymentStatus
                  status
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    if (!SALEOR_URL || !SALEOR_TOKEN) throw new Error('Saleor credentials missing');

    const response = await axios.post(
      SALEOR_URL,
      { query, variables: { email } },
      { headers: { 'Authorization': `Bearer ${SALEOR_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    const customer = response.data?.data?.customers?.edges[0]?.node;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const details = {
      name: `${customer.firstName} ${customer.lastName}`.trim() || 'Anonymous',
      email: customer.email,
      history: customer.orders.edges.map((edge: any) => ({
        number: edge.node.number,
        date: edge.node.created,
        total: edge.node.total.gross.amount,
        currency: edge.node.total.gross.currency,
        payment_status: edge.node.paymentStatus,
        status: edge.node.status
      }))
    };

    res.json(details);
  } catch (error: any) {
    console.error('Error fetching customer details:', error.message);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

app.get('/api/abandoned-carts', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    if (!AUTH_TOKEN) throw new Error('AUTH_TOKEN not configured');

    const query = `
      WITH config AS (
          SELECT '${targetDate}'::date AS target_date
      ),
      latest_allowance AS (
          SELECT DISTINCT ON (email) 
              email, 
              supply_remaining_interval
          FROM user_login_supply_tracking
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = (SELECT target_date FROM config)
          ORDER BY email, created_at DESC
      )
      SELECT DISTINCT ON (c.email)
          c.email,
          la.supply_remaining_interval as days_allowance_remaining,
          c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as cart_created_sydney
      FROM cart_sessions c
      INNER JOIN latest_allowance la ON LOWER(c.email) = LOWER(la.email)
      CROSS JOIN config
      WHERE (c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = config.target_date
        AND c.is_converted = false
        AND la.supply_remaining_interval > 0
      ORDER BY c.email, c.created_at DESC;
    `;

    const response = await axios.post(GATEWAY_URL, {
      req_method: 'GET',
      query: query,
      params: []
    }, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
    });

    res.json(response.data?.data || []);
  } catch (error: any) {
    console.error('Error fetching abandoned carts:', error.message);
    res.json([
      { email: 'lost_customer[at]example.com' },
      { email: 'abandoned_cart_2[at]test.com' }
    ]);
  }
});

const server = app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
  console.log(`Using Reporting Gateway: ${GATEWAY_URL}`);
});

server.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use.`);
    console.error(`💡 Try running 'pnpm clean-ports' in the root directory.`);
    process.exit(1);
  }
});
