const tokenValidator = async (req, res, next) => {
  try {
    const { instagram_token } = req.headers;

    if (!instagram_token) {
      return res
        .status(403)
        .json({ message: "No puedes acceder a esta solicitud" });
    }

    if (instagram_token !== process.env.SERVICE_TOKEN) {
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
