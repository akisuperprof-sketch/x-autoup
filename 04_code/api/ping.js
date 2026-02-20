module.exports = (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: 'v4.10-smart-schedule',
        message: 'Deployment is WORKING'
    });
};
