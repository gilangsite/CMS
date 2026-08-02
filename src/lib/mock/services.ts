import { ContentItem } from "@/types/domain";
import { mockContentItems } from "./data";

// Simple artificial delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchContentItems(): Promise<ContentItem[]> {
  await delay(600);
  return mockContentItems;
}

export async function fetchContentItem(id: string): Promise<ContentItem | undefined> {
  await delay(400);
  return mockContentItems.find((c) => c.id === id);
}

export async function submitForReview(id: string): Promise<ContentItem> {
  await delay(800);
  const item = mockContentItems.find((c) => c.id === id);
  if (!item) throw new Error("Not found");
  
  item.approvalStatus = "in_review";
  item.publishingStatus = "pending_approval";
  item.updatedAt = new Date().toISOString();
  return { ...item };
}

export async function approveContent(id: string): Promise<ContentItem> {
  await delay(800);
  const item = mockContentItems.find((c) => c.id === id);
  if (!item) throw new Error("Not found");
  
  item.approvalStatus = "approved";
  if (item.scheduledDate) {
    item.publishingStatus = "scheduled";
  } else {
    item.publishingStatus = "draft";
  }
  item.updatedAt = new Date().toISOString();
  return { ...item };
}

export async function scheduleContent(id: string, date: string): Promise<ContentItem> {
  await delay(800);
  const item = mockContentItems.find((c) => c.id === id);
  if (!item) throw new Error("Not found");
  
  item.scheduledDate = date;
  if (item.approvalStatus === "approved") {
    item.publishingStatus = "scheduled";
  }
  item.updatedAt = new Date().toISOString();
  return { ...item };
}

export async function publishNow(id: string): Promise<ContentItem> {
  await delay(1500);
  const item = mockContentItems.find((c) => c.id === id);
  if (!item) throw new Error("Not found");
  
  item.publishingStatus = "posting";
  item.updatedAt = new Date().toISOString();
  
  // Simulate it finishing quickly for demo
  setTimeout(() => {
    if (item.postMode === "semi_auto") {
      item.publishingStatus = "needs_manual_finalization";
    } else {
      item.publishingStatus = "posted";
    }
  }, 3000);
  
  return { ...item };
}
