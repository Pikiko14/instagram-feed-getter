const tokenValidator = async (req, res, next) => {
  try {
    const { host } = req.headers;

    if (!host) {
      return res
        .status(403)
        .json({ message: "No puedes acceder a esta solicitud" });
    }

    if (host !== 'api.motowork.co') {
      return res
        .status(403)
        .json({ message: "No puedes acceder a esta solicitud" });
    }

    next();
  } catch (error) {
    return res.status(403).send("No puedes acceder a esta solicitud");
  }
};

module.exports = tokenValidator;
