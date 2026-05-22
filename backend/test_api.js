const axios = require('axios');

const test = async () => {
  try {
    const res = await axios.get('http://localhost:5001/api/dashboard/analytics');
    console.log('Analytics response status:', res.status);
    console.log('Analytics data:', JSON.stringify(res.data, null, 2).slice(0, 500));
  } catch (err) {
    console.error('Analytics error:', err.response?.status, err.message);
  }

  try {
    const res = await axios.get('http://localhost:5001/api/dashboard/reports');
    console.log('Reports response status:', res.status);
    console.log('Reports data:', JSON.stringify(res.data, null, 2).slice(0, 500));
  } catch (err) {
    console.error('Reports error:', err.response?.status, err.message);
  }
};

test();
