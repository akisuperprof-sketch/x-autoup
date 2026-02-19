module.exports = (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: 'v4.7-deploy-test',
        message: 'Deployment is WORKING'
    });
};
