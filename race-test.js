// Sends 50 bids at the same time and checks the highest one wins (run npm start first)
const URL = 'http://localhost:3000';

async function main() {
  const start = (await (await fetch(URL + '/state')).json()).auction.highest_bid;

  // 50 different amounts, in random order
  const amounts = [];
  for (let i = 1; i <= 50; i++) amounts.push(start + i * 10);
  amounts.sort(() => Math.random() - 0.5);

  // Send all bids at once
  await Promise.all(amounts.map((amount, i) =>
    fetch(URL + '/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidder: 'user' + i, amount })
    })
  ));

  // The saved highest bid should be the biggest amount we sent
  const final = (await (await fetch(URL + '/state')).json()).auction.highest_bid;
  const expected = Math.max(...amounts);
  console.log('Expected highest:', expected, '| Saved highest:', final);
  console.log(final === expected ? 'PASS' : 'FAIL');
}

main();
