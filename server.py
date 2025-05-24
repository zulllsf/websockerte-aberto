import asyncio
import json
import websockets

# Dictionary to store connected clients in rooms
# rooms = {"room_name": {client_websocket1, client_websocket2}}
rooms = {}

# Dictionary to store offers and answers
# offers_and_answers = {"room_name": {"offer": offer_sdp, "answer": answer_sdp}}
offers_and_answers = {}


async def handler(websocket, path):
    print(f"Client connected: {websocket.remote_address}")
    client_room_name = None  # Keep track of the room this client joined
    try:
        async for message_str in websocket:
            try:
                data = json.loads(message_str)
                message_type = data.get("type")
                room = data.get("room") # 'room' key is used by client

                if not room and message_type != "join": # Most messages require a room
                    await websocket.send(json.dumps({"type": "error", "message": "Room not specified in message."}))
                    continue

                if message_type == "join":
                    if room:
                        client_room_name = room # Assign room to this client's scope
                        if room not in rooms:
                            rooms[room] = set()
                        
                        if len(rooms[room]) < 2:
                            rooms[room].add(websocket)
                            print(f"Client {websocket.remote_address} joined room {room}")
                            await websocket.send(json.dumps({"type": "join_ack", "message": f"Successfully joined room {room}"}))
                            if len(rooms[room]) == 2:
                                print(f"Room {room} is full. Notifying clients to start WebRTC signaling.")
                                for client_ws in rooms[room]:
                                    await client_ws.send(json.dumps({"type": "room_full", "room": room}))
                        elif websocket not in rooms[room]: # len is >= 2 and current client is not already in
                            print(f"Room {room} is full. Client {websocket.remote_address} cannot join.")
                            await websocket.send(json.dumps({"type": "error", "message": f"Room {room} is full."}))
                        # If client is already in the room and room has 2, no action, or could re-send room_full
                        elif websocket in rooms[room] and len(rooms[room]) == 2:
                             await websocket.send(json.dumps({"type": "room_full", "room": room}))


                    else:
                        await websocket.send(json.dumps({"type": "error", "message": "Room not specified for join action."}))
                
                elif message_type == "offer":
                offer_sdp = data.get("offer")
                if room and offer_sdp:
                    if room not in offers_and_answers:
                        offers_and_answers[room] = {}
                    offers_and_answers[room]["offer"] = offer_sdp
                    print(f"Received offer for room {room}")

                    # Forward offer to the other client in the room
                    if room in rooms and len(rooms[room]) == 2:
                        other_client = None
                        for client_ws in rooms[room]:
                            if client_ws != websocket:
                                other_client = client_ws
                                break
                        if other_client:
                            await other_client.send(json.dumps({"type": "offer", "offer": offer_sdp, "room": room}))
                            print(f"Forwarded offer to {other_client.remote_address} in room {room}")
                        else:
                            # This case should ideally not happen if room_full was sent correctly
                            print(f"Offer received, but no other client in room {room} to forward to.")
                    elif room in rooms and len(rooms[room]) == 1 and websocket in rooms[room]:
                         print(f"Offer received for room {room}, but only one client (the sender). Storing offer.")
                         # Offer is stored, will be used when the second client joins and server sends room_full
                    elif room not in rooms or websocket not in rooms[room]:
                        await websocket.send(json.dumps({"type": "error", "message": f"You are not in room {room}."}))
                else:
                    await websocket.send(json.dumps({"type": "error", "message": "Room or offer SDP not specified."}))

            elif message_type == "answer":
                answer_sdp = data.get("answer")
                if room and answer_sdp:
                    if room not in offers_and_answers:
                        # This shouldn't happen if offer was already made
                        offers_and_answers[room] = {} 
                    offers_and_answers[room]["answer"] = answer_sdp
                    print(f"Received answer for room {room}")

                    # Forward answer to the other client in the room
                    if room in rooms and len(rooms[room]) == 2:
                        other_client = None
                        for client_ws in rooms[room]:
                            if client_ws != websocket:
                                other_client = client_ws
                                break
                        if other_client:
                            await other_client.send(json.dumps({"type": "answer", "answer": answer_sdp, "room": room}))
                            print(f"Forwarded answer to {other_client.remote_address} in room {room}")
                else:
                    await websocket.send(json.dumps({"type": "error", "message": "Room or answer SDP not specified"}))

            elif message_type == "ice-candidate":
                candidate = data.get("candidate")
                if room and candidate:
                    print(f"Received ICE candidate for room {room}")
                    # Forward ICE candidate to the other client in the room
                    if room in rooms and len(rooms[room]) == 2:
                        other_client = None
                        for client_ws in rooms[room]:
                            if client_ws != websocket:
                                other_client = client_ws
                                break
                        if other_client:
                            await other_client.send(json.dumps({"type": "ice-candidate", "candidate": candidate, "room": room}))
                            # print(f"Forwarded ICE candidate to {other_client.remote_address} in room {room}")
                        # No specific error if other_client is not found, could happen if peer disconnected mid-exchange
                    elif room not in rooms or websocket not in rooms[room]:
                         await websocket.send(json.dumps({"type": "error", "message": f"You are not in room {room}."}))
                else:
                    await websocket.send(json.dumps({"type": "error", "message": "Room or ICE candidate not specified."}))
                
                else:
                    if room: # Only send error if room was specified but type unknown
                        await websocket.send(json.dumps({"type": "error", "message": f"Unknown message type: {message_type}"}))
            
            except json.JSONDecodeError:
                print(f"Invalid JSON received from {websocket.remote_address}: {message_str}")
                await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON format."}))
            except Exception as e:
                print(f"Error processing message from {websocket.remote_address}: {e}")
                try:
                    await websocket.send(json.dumps({"type": "error", "message": "An error occurred processing your message."}))
                except websockets.exceptions.ConnectionClosed:
                    pass # Client might have disconnected

    except (websockets.exceptions.ConnectionClosedOK, websockets.exceptions.ConnectionClosedError) as e:
        print(f"Client {websocket.remote_address} disconnected. Reason: {type(e).__name__}")
    except Exception as e:
        # Catch any other unexpected errors during the handler's lifecycle (outside message loop)
        print(f"Unexpected error for client {websocket.remote_address}: {e}")
    finally:
        print(f"Cleaning up connection for {websocket.remote_address}. Initial room: {client_room_name}")
        if client_room_name and client_room_name in rooms:
            if websocket in rooms[client_room_name]:
                rooms[client_room_name].remove(websocket)
                print(f"Client {websocket.remote_address} removed from room {client_room_name}")

                if not rooms[client_room_name]:  # Room is now empty
                    print(f"Room {client_room_name} is empty, deleting.")
                    del rooms[client_room_name]
                    if client_room_name in offers_and_answers:
                        del offers_and_answers[client_room_name]
                        print(f"Cleaned up offers/answers for room {client_room_name}.")
                else:  # Room still has one peer
                    remaining_client = list(rooms[client_room_name])[0]
                    print(f"Notifying remaining client {remaining_client.remote_address} in room {client_room_name} that peer has left.")
                    try:
                        await remaining_client.send(json.dumps({
                            "type": "peer_left", 
                            "room": client_room_name,
                            "message": "The other user has disconnected."
                        }))
                    except websockets.exceptions.ConnectionClosed:
                        # If the remaining client is also disconnected, this might fail
                        print(f"Could not notify remaining client in room {client_room_name}, connection closed.")
        else:
            # Client was not in any tracked room or room was already cleaned up
            # Iterate all rooms as a fallback, though client_room_name should make this mostly unnecessary
            for r_name, r_clients in list(rooms.items()): # Use list(rooms.items()) for safe iteration if modifying dict
                if websocket in r_clients:
                    r_clients.remove(websocket)
                    print(f"Client {websocket.remote_address} removed from room {r_name} (fallback cleanup).")
                    if not r_clients:
                        del rooms[r_name]
                        if r_name in offers_and_answers:
                            del offers_and_answers[r_name]
                    else:
                        try:
                            remaining_client = list(r_clients)[0]
                            await remaining_client.send(json.dumps({
                                "type": "peer_left", 
                                "room": r_name,
                                "message": "The other user has disconnected."
                            }))
                            print(f"Notified remaining client in room {r_name} (fallback cleanup).")
                        except websockets.exceptions.ConnectionClosed:
                             print(f"Could not notify remaining client in room {r_name} (fallback cleanup), connection closed.")
                    break # Found and handled
        print(f"Finished cleanup for {websocket.remote_address}. Current rooms: {list(rooms.keys())}")


async def main():
    port = 8765
    print(f"Starting WebSocket server on ws://localhost:{port}")
    async with websockets.serve(handler, "localhost", port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
