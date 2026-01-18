// API wrapper for backend communication
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  // Sessions
  async createSession(name, numCourts) {
    return this.request('/sessions', {
      method: 'POST',
      body: { name, num_courts: numCourts },
    });
  },

  async getSession(id) {
    return this.request(`/sessions/${id}`);
  },

  async getAllSessions() {
    return this.request('/sessions');
  },

  async endSession(id) {
    return this.request(`/sessions/${id}/end`, {
      method: 'PUT',
    });
  },

  async getSessionSummary(id) {
    return this.request(`/sessions/${id}/summary`);
  },

  // Players
  async addPlayers(sessionId, players) {
    return this.request(`/sessions/${sessionId}/players`, {
      method: 'POST',
      body: { players },
    });
  },

  async getPlayers(sessionId) {
    return this.request(`/sessions/${sessionId}/players`);
  },

  async getWaitingPlayers(sessionId) {
    return this.request(`/sessions/${sessionId}/waiting`);
  },

  // Games
  async recordGame(sessionId, gameData) {
    return this.request(`/sessions/${sessionId}/games`, {
      method: 'POST',
      body: gameData,
    });
  },

  async getGames(sessionId) {
    return this.request(`/sessions/${sessionId}/games`);
  },

  // Courts
  async getCourts(sessionId) {
    return this.request(`/sessions/${sessionId}/courts`);
  },

  async assignCourt(sessionId, courtData) {
    return this.request(`/sessions/${sessionId}/assign-court`, {
      method: 'POST',
      body: courtData,
    });
  },

  async clearCourt(sessionId, courtNumber) {
    return this.request(`/sessions/${sessionId}/courts/${courtNumber}`, {
      method: 'DELETE',
    });
  },

  // Rotation
  async getNextMatches(sessionId) {
    return this.request(`/sessions/${sessionId}/next-matches`, {
      method: 'POST',
    });
  },
};
