// Preview-only test runner. Removed before merging to production.
module.exports = async function handler(req, res) {
  try {
    require('../scripts/trust-regression');
    return res.status(200).json({ status: 'passed', suite: 'trust-regression' });
  } catch (err) {
    return res.status(500).json({ status: 'failed', message: String(err && err.message || err) });
  }
};
