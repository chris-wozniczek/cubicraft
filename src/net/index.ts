/**
 * Cubicraft — networking layer.
 *
 * True peer-to-peer over a home Wi-Fi LAN: the host player's browser owns
 * the world, guests talk to it over a WebRTC data channel.  There is no game
 * server anywhere.
 *
 * Typical flow:
 *
 *   host:   const peer = new PeerConnection({ isHost: true, ... });
 *           const pack = await peer.createHostJoinPack();
 *           // show `formatJoinCode(pack)` or the QR payload
 *
 *   guest:  const client = new GuestClient({ ... });
 *           const answer = await client.join(pack);
 *           // send `answer` back to the host
 *
 *   host:   await peer.acceptAnswer(answer);
 */

export * from './codec';
export * from './protocol';
export * from './peer';
export * from './pairing';
export * from './hostAuthority';
export * from './guestClient';
export * from './interest';
export * from './persistence';
export * from './diagnostics';
