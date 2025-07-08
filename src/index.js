const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const qs = require("qs");
const redis = require("redis");
const cors = require("cors");
const hostValidator = require("./middlewares/hostValidator");
const tokenValidator = require("./middlewares/tokenValidator");

dotenv.config();

const app = express();
const port = 3081;

const corsOptions = {
  origin: [
    "http://localhost:9000",
    "http://localhost:9200",
    "https://app.motowork.xyz",
    "http://localhost:9001",
    "http://testbanner.test",
    "http://admin.motowork.xyz",
    "https://admin.motowork.xyz",
    "http://app.motowork.xyz",
    "https://app.motowork.xyz",
    "https://motowork.xyz",
    "http://motowork.xyz",
    "http://motowork.co",
    "https://motowork.co"
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Configuración de Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis error:", err));
redisClient.connect();

// Ruta para redirigir al usuario a la página de autorización de Instagram
app.get("/auth", hostValidator, async (req, res) => {
  const cachedToken = await redisClient.get("access_token");
  const session = await validateToken();

  if (cachedToken && !session.error) {
    return res.send({ token: cachedToken, message: "Token loaded from cache" });
  }

  const authUrl = `https://www.instagram.com/oauth/authorize/?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${process.env.INSTAGRAM_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish`;
  res.redirect(authUrl);
});

// Callback después de la autorización
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send("Authorization code is missing.");
  }

  try {
    const data = qs.stringify({
      client_id: process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      code,
    });

    const response = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = response.data;

    // Guardar el token en Redis con un tiempo de expiración de 1 dias
    const cachedToken = await redisClient.get("access_token");
    if (cachedToken) {
      await redisClient.del("access_token");
    }
    await redisClient.setEx("access_token", 86400, access_token);

    res.redirect(process.env.APP_URL);
  } catch (error) {
    res.send(error.response?.data || error.message);
  }
});

// Ruta para validar y extender un token
app.get("/validate-and-extend-token", hostValidator, async (req, res) => {
  const cachedToken = await redisClient.get("access_token");

  if (cachedToken) {
    try {
      // Validar y extender el token
      const response = await axios.get(
        "https://graph.instagram.com/access_token",
        {
          params: {
            grant_type: "ig_exchange_token",
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
            access_token: cachedToken,
          },
        }
      );

      const { access_token, expires_in } = response.data;

      // Guardar el token extendido en Redis con tiempo de expiración calculado
      await redisClient.del("access_token");
      await redisClient.setEx("access_token", expires_in, access_token);

      res.redirect(process.env.APP_URL);
    } catch (error) {
      res.send(error.message);
    }
  } else {
    return res.send("Access token is missing.");
  }
});

// Ruta para obtener los feeds de Instagram
app.get("/get-feeds", tokenValidator, async (req, res) => {
  const cachedFeeds = await redisClient.get("feeds_items");

  if (cachedFeeds) {
    return res.json({ success: true, data: JSON.parse(cachedFeeds) });
  }

  // Validar token
  const tokenValidation = await validateToken();

  // Check if the token is valid
  if (tokenValidation.error) {
    return res.status(400).send("Token invalid.");
  }

  // Obtener el token de acceso desde Redis
  const accessToken = await redisClient.get("access_token");

  if (!accessToken) {
    return res.status(400).send("Access token is missing or expired.");
  }

  try {
    // Solicitar la información de los feeds usando el Instagram Graph API
    const response = await axios.get("https://graph.instagram.com/me/media", {
      params: {
        fields: "id,caption,media_type,media_url,thumbnail_url,timestamp",
        access_token: accessToken,
        limit: 4,
      },
    });

    if (response.data.data) {
      await redisClient.setEx(
        "feeds_items",
        86400,
        JSON.stringify(response.data.data)
      );
    }

    const feeds = response.data.data; // Los datos del feed estarán en la propiedad `data`

    // Devolver la información de los feeds
    return res.json({ success: true, data: feeds });
  } catch (error) {
    console.error(
      "Error getting feeds:",
      error.response?.data || error.message
    );
    return res.status(500).send("Error retrieving feeds.");
  }
});

// get session data
app.get("/session/status", tokenValidator, async (req, res) => {
  try {
    let session = await redisClient.get("user_session");
    if (session) {
      session = JSON.parse(session);
      if (session.userId) {
        return res.status(200).json(session);
      }
    }

    session = await validateToken();
    if (session.error) {
      return res.status(500).json(session);
    }

    await redisClient.setEx("user_session", 86400, JSON.stringify(session));
    res.status(200).json(session);
  } catch (error) {
    return res.status(500).json(error);
  }
});

// validate token
const validateToken = async () => {
  try {
    // Obtener el token almacenado en Redis
    const accessToken = await redisClient.get("access_token");

    if (!accessToken) {
      return {
        error: true,
        message: "No se ha encontrado una sesión con instagram.",
      };
    }

    // Validar el token llamando a la API de Instagram
    const response = await axios.get("https://graph.instagram.com/me", {
      params: {
        fields: "id,username",
        access_token: accessToken,
      },
    });

    if (response.data && response.data.id) {
      return {
        error: false,
        message: "Token is valid",
        userId: response.data.id,
        response: response.data,
      };
    } else {
      return { error: true, message: "La sesión expiro" };
    }
  } catch (error) {
    console.log(error.response.data)
    return { error: true, message: "No se encontro sesión con instagram" };
  }
};

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
