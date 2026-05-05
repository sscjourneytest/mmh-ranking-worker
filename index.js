export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const dbUrl = searchParams.get('dbUrl');
    const quizId = searchParams.get('quizId');
    const score = parseFloat(searchParams.get('score') || 0);
    const time = parseInt(searchParams.get('timeTaken') || 0);

    if (!dbUrl || !quizId) return new Response("Missing Data", { status: 400 });

    try {
      // --- ADVANCED FILTERED QUERIES ---
      // We use .json?shallow=true to get only keys for the total count
      // We use limitToLast(10) to fetch only 10 toppers, not thousands
      
      const higherScoreUrl = `${dbUrl}/attempt_history/${quizId}.json?orderBy="score"&startAfter=${score}`;
      const tieBreakerUrl = `${dbUrl}/attempt_history/${quizId}.json?orderBy="score"&equalTo=${score}`;
      const topperUrl = `${dbUrl}/quiz_results/${quizId}.json?orderBy="score"&limitToLast=10`;
      const totalCountUrl = `${dbUrl}/attempt_history/${quizId}.json?shallow=true`;

      const [highRes, tieRes, topRes, totalRes] = await Promise.all([
        fetch(higherScoreUrl),
        fetch(tieBreakerUrl),
        fetch(topperUrl),
        fetch(totalCountUrl)
      ]);

      const higherData = await highRes.json() || {};
      const tieData = await tieRes.json() || {};
      const toppersRaw = await topRes.json() || {};
      const totalData = await totalRes.json() || {};

      // Logic for Rank & Tie-Breaker
      const countHigher = Object.keys(higherData).length;
      const countFasterTies = Object.values(tieData).filter(att => att.timeTaken < time).length;
      const finalRank = countHigher + countFasterTies + 1;
      const totalParticipants = Object.keys(totalData).length;

      // Ensure the Top 10 are sorted correctly (Score desc, Time asc)
      const toppers = Object.values(toppersRaw).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      }).reverse();

      return new Response(JSON.stringify({
        status: "success",
        rank: finalRank,
        total: totalParticipants,
        percentile: totalParticipants > 1 ? (((totalParticipants - finalRank) / (totalParticipants - 1)) * 100).toFixed(2) : "100.00",
        toppers: toppers
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
        
