module.exports = (event, fields = {}) => console.log(JSON.stringify({ event, ...fields }));
