module.exports = (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: 'v4.8-similarity-fix',
        message: 'Deployment is WORKING'
    });
};
