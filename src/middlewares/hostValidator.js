const hostValidator = async (req, res, next) => {
  try {
    const availableOrigin = [
      "http://localhost:9000/",
      "http://localhost:9200/",
      "https://app.motowork.xyz/",
      "http://localhost:9001/",
      "http://admin.motowork.xyz/",
      "https://admin.motowork.xyz/",
      "http://app.motowork.xyz/",
      "https://app.motowork.xyz/",
      "https://motowork.xyz/",
      "http://motowork.xyz/",
      "http://motowork.co",
      "https://motowork.co",
      "http://admin.motowork.co",
      "https://admin.motowork.co",
    ];

    const referer = req.get("Referer");

    // Verificar si el origen está permitido
    if (!availableOrigin.includes(referer)) {
      return res.status(403).send("Acceso no permitido desde este origen");
    }

    next();
  } catch (error) {
    return res.status(403).send("No puedes acceder a esta solicitud");
  }
};

module.exports = hostValidator;
