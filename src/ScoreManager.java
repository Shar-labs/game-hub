package gamehub;

import java.util.HashMap;
import java.util.Map;

/**
 * ScoreManager.java
 * Utility class for managing 2-player game scores.
 * Part of the Game Hub multi-language project.
 * (In a server-side Java deployment, this would persist scores to a database.)
 */
public class ScoreManager {
    private final Map<String, Integer> scores = new HashMap<>();
    private final String[] players;

    public ScoreManager(String player1, String player2) {
        this.players = new String[]{player1, player2};
        scores.put(player1, 0);
        scores.put(player2, 0);
    }

    public void addPoint(String player) {
        scores.merge(player, 1, Integer::sum);
    }

    public int getScore(String player) {
        return scores.getOrDefault(player, 0);
    }

    public String getLeader() {
        int s1 = getScore(players[0]);
        int s2 = getScore(players[1]);
        if (s1 > s2) return players[0];
        if (s2 > s1) return players[1];
        return "TIE";
    }

    public void reset() {
        for (String p : players) scores.put(p, 0);
    }

    @Override
    public String toString() {
        return players[0] + ": " + getScore(players[0]) + " | " + players[1] + ": " + getScore(players[1]);
    }

    public static void main(String[] args) {
        ScoreManager sm = new ScoreManager("Player 1", "Player 2");
        sm.addPoint("Player 1");
        sm.addPoint("Player 1");
        sm.addPoint("Player 2");
        System.out.println(sm);
        System.out.println("Leader: " + sm.getLeader());
    }
}
