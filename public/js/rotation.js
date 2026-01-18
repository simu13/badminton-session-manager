// Rotation algorithm utilities
const Rotation = {
  /**
   * Sort players by wait time (longest wait first)
   * Players who never played come first
   */
  sortByWaitTime(players) {
    return [...players].sort((a, b) => {
      // Players who never played get priority
      if (!a.last_played_at && b.last_played_at) return -1;
      if (a.last_played_at && !b.last_played_at) return 1;
      if (!a.last_played_at && !b.last_played_at) {
        // Both never played, sort by games played (fewer first)
        return a.games_played - b.games_played;
      }

      // Both have played, sort by last played time
      const aTime = new Date(a.last_played_at).getTime();
      const bTime = new Date(b.last_played_at).getTime();
      if (aTime !== bTime) {
        return aTime - bTime; // Earlier time = longer wait = higher priority
      }

      // Same time, sort by games played
      return a.games_played - b.games_played;
    });
  },

  /**
   * Create balanced teams from 4 players
   * Pairs 1st+4th vs 2nd+3rd for slight balance by wait time
   */
  createTeams(players) {
    if (players.length < 4) {
      return null;
    }

    const sorted = this.sortByWaitTime(players);
    const fourPlayers = sorted.slice(0, 4);

    return {
      team1: [fourPlayers[0], fourPlayers[3]],
      team2: [fourPlayers[1], fourPlayers[2]],
    };
  },

  /**
   * Generate matches for multiple courts
   */
  generateMatches(availablePlayers, numCourts) {
    const matches = [];
    const sorted = this.sortByWaitTime(availablePlayers);
    let index = 0;

    for (let court = 1; court <= numCourts; court++) {
      if (index + 4 <= sorted.length) {
        const fourPlayers = sorted.slice(index, index + 4);
        matches.push({
          court_number: court,
          team1: [fourPlayers[0], fourPlayers[3]],
          team2: [fourPlayers[1], fourPlayers[2]],
        });
        index += 4;
      }
    }

    return {
      matches,
      waitingPlayers: sorted.slice(index),
    };
  },

  /**
   * Format wait time for display
   */
  formatWaitTime(lastPlayedAt) {
    if (!lastPlayedAt) {
      return 'Never played';
    }

    const now = new Date();
    const played = new Date(lastPlayedAt);
    const diffMs = now - played;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return 'Just played';
    } else if (diffMins === 1) {
      return '1 min ago';
    } else if (diffMins < 60) {
      return `${diffMins} mins ago`;
    } else {
      const hours = Math.floor(diffMins / 60);
      return `${hours}h ${diffMins % 60}m ago`;
    }
  },
};
