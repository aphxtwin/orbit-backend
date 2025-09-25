const axios = require('axios')

async function getInstagramUserName(userId, accessToken) {
    try {
      // ✅ CORRECTO - Usar Facebook Graph API
      const response = await axios.get(
        `https://graph.facebook.com/v20.0/${userId}`,
        {
          params: {
            fields: "id,username,name",
            access_token: accessToken
          }
        }
      );
      return response.data.username || response.data.name;
    } catch (error) {
      console.error("Instagram API Error:", error.response?.data || error.message);
      return null;
    }
  }

  module.exports = { getInstagramUserName };