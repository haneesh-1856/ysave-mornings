// Runs once in the parent process before workers start, so every test sees the same DST rules.
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
