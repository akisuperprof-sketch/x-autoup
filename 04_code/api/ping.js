module.exports = (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: 'v4.9-count-logic',
        message: 'Deployment is WORKING'
    });
};
