const tokenValidator = async (req, res, next) => {
  try {
    const { instagram_token } = req.headers;
    console.log(req.headers);
    console.log(instagram_token);

    if (!instagram_token) {
      return res
        .status(403)
        .json({ message: "No puedes acceder a esta solicitud33" });
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
