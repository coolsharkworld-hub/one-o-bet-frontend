const convertApiToCricket = (apiRes, eventId) => {
  if (!apiRes.status) return null
  const entity = apiRes.data
  const cricketScore = {
    eventId: eventId,
    inning: parseInt(entity.current_inning),
    Title: `${entity.team_a} vs ${entity.team_b}`,
    over1: entity.team_a_over?.split('&').pop().trim(),
    over2: entity.team_b_over?.split('&').pop().trim(),
    overs: entity.last4overs,
    res: entity.result,
    result: entity.first_circle ?? entity.second_circle,
    comment: entity.need_run_ball || entity.trail_lead || entity.toss || '',
    activeTeam: (entity.batting_team == entity.team_a_id) ? entity.team_a_short : entity.team_b_short,
    score1: entity.team_a_scores?.split('&').pop().trim().replace('-', '/'),
    score2: entity.team_b_scores?.split('&').pop().trim().replace('-', '/'),
    RRR: entity.rr_rate,
    CRR: entity.curr_rate,
    team1Flag: entity.team_a_img,
    team2Flag: entity.team_b_img,
    team1Name: entity.team_a,
    team2Name: entity.team_b,
    team1ShortName: entity.team_a_short,
    team2ShortName: entity.team_b_short,
    type: entity.match_type,
    matchTitle: `${entity.team_a} vs ${entity.team_b}`,
    // seriesKey: '',
    // __v: entity,
    // day: entity,
    // matchEnglishTitle: entity,
    // matchNo: entity,
    // meta: entity,
    // seriesFullName: entity,
    // rateTeam: entity,
    // seriesName: entity,
    // seriesTitle: entity,
    // state: entity,
    // time: entity,
    // venueName: entity,
    // timestamp: entity,
  }
  return cricketScore
}

const convertCricketToFront = (score) => {
  const lastOver = score?.overs?.pop()
  return {
    eventId: score.eventId,
    seriesKey: score.seriesKey,
    score: {
      activenation1: (score.activeTeam === score.team1ShortName) ? 1 : 0,
      activenation2: (score.activeTeam === score.team2ShortName) ? 1 : 0,
      balls: lastOver?.balls ?? [],
      overScore: lastOver?.runs ?? 0,
      lastOver,
      inning: score.inning,
      dayno: "",
      comment: score?.comment,
      isfinished: "0",
      score1: `${score?.score1?.replace('/', '-')} (${score?.over1 ?? ''})`,
      score2: `${score?.score2?.replace('/', '-')} (${score?.over2 ?? ''})`,
      spnballrunningstatus: score?.result,
      spnmessage: "",
      spnnation1: score?.team1ShortName,
      spnnation2: score?.team2ShortName,
      spnreqrate1: `RRR ${score?.RRR ?? ''}`,
      spnreqrate2: `RRR ${score?.RRR ?? ''}`,
      spnrunrate1: `CRR ${score?.CRR ?? ''}`,
      spnrunrate2: `CRR ${score?.CRR ?? ''}`,
    }
  }
}

module.exports = { convertApiToCricket, convertCricketToFront }
