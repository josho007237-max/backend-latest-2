// src/types/line.d.ts

export interface LineWebhookEvent {
  type: "message" | "follow" | "unfollow" | "postback" | "join" | "leave" | "memberJoined" | "memberLeft";
  mode: "active" | "standby";
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  webhookEventId: string;
  deliveryContext: {
    isRedelivery: boolean;
  };
  replyToken?: string;
  message?: {
    type: "text" | "sticker" | "image" | "video" | "audio" | "location" | "file";
    id: string;
    text?: string;
  };
}
