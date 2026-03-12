import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ===== Auth =====

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected || !apiKey) return false;
  return apiKey === expected;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

function getUserId(): string | null {
  return process.env.TASKMA_USER_ID ?? null;
}

// ===== GET: タスク取得 =====

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "TASKMA_USER_ID not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date parameter required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceClient();

    // Fetch sections
    const { data: sections } = await supabase
      .from("sections")
      .select("id, name, sort_order")
      .eq("user_id", userId)
      .order("sort_order");

    // Fetch tasks for the date
    const { data: tasks, error } = await supabase
      .from("daily_tasks")
      .select("id, title, status, estimated_minutes, actual_minutes, started_at, completed_at, eisenhower_quadrant, section_id, sort_order")
      .eq("user_id", userId)
      .eq("date", date)
      .order("sort_order");

    if (error) {
      console.error("Integration GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    const taskList = tasks ?? [];
    const sectionList = sections ?? [];

    // Build section map
    const sectionMap = new Map(
      sectionList.map((s) => [s.id, s.name])
    );

    // Group tasks by section
    const sectionGroups: {
      name: string;
      tasks: {
        id: string;
        title: string;
        status: string;
        estimated_minutes: number;
        actual_minutes: number | null;
        started_at: string | null;
        completed_at: string | null;
        eisenhower_quadrant: string | null;
      }[];
    }[] = [];

    // Create ordered section groups
    for (const section of sectionList) {
      const sectionTasks = taskList
        .filter((t) => t.section_id === section.id)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          estimated_minutes: t.estimated_minutes,
          actual_minutes: t.actual_minutes,
          started_at: t.started_at,
          completed_at: t.completed_at,
          eisenhower_quadrant: t.eisenhower_quadrant,
        }));

      if (sectionTasks.length > 0) {
        sectionGroups.push({
          name: section.name,
          tasks: sectionTasks,
        });
      }
    }

    // Tasks without section
    const unsectioned = taskList
      .filter((t) => !t.section_id || !sectionMap.has(t.section_id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes,
        started_at: t.started_at,
        completed_at: t.completed_at,
        eisenhower_quadrant: t.eisenhower_quadrant,
      }));

    if (unsectioned.length > 0) {
      sectionGroups.push({ name: "未分類", tasks: unsectioned });
    }

    // Summary
    const completed = taskList.filter((t) => t.status === "done").length;
    const totalEstimated = taskList.reduce(
      (sum, t) => sum + (t.estimated_minutes ?? 0),
      0
    );
    const totalActual = taskList.reduce(
      (sum, t) => sum + (t.actual_minutes ?? 0),
      0
    );

    return NextResponse.json({
      date,
      summary: {
        total: taskList.length,
        completed,
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: totalActual,
      },
      sections: sectionGroups,
    });
  } catch (err) {
    console.error("Integration GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== POST: タスク作成 =====

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "TASKMA_USER_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { date, tasks } = body as {
      date: string;
      tasks: {
        title: string;
        eisenhower_quadrant?: string;
        estimated_minutes?: number;
      }[];
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "tasks array required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Get max sort_order for the date
    const { data: existing } = await supabase
      .from("daily_tasks")
      .select("sort_order")
      .eq("user_id", userId)
      .eq("date", date)
      .order("sort_order", { ascending: false })
      .limit(1);

    let nextSortOrder = ((existing?.[0]?.sort_order as number) ?? 0) + 1;

    const created: { id: string; title: string }[] = [];

    for (const task of tasks) {
      if (!task.title || !task.title.trim()) continue;

      const { data, error } = await supabase
        .from("daily_tasks")
        .insert({
          user_id: userId,
          date,
          title: task.title.trim(),
          estimated_minutes: task.estimated_minutes ?? 15,
          eisenhower_quadrant: task.eisenhower_quadrant ?? null,
          sort_order: nextSortOrder++,
          status: "pending",
        })
        .select("id, title")
        .single();

      if (error) {
        console.error("Integration POST insert error:", error);
        continue;
      }

      if (data) {
        created.push({ id: data.id, title: data.title });
      }
    }

    return NextResponse.json({
      created: created.length,
      tasks: created,
    });
  } catch (err) {
    console.error("Integration POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== PATCH: タスクステータス更新 =====

export async function PATCH(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "TASKMA_USER_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { taskId, status, actual_minutes } = body as {
      taskId: string;
      status?: string;
      actual_minutes?: number;
    };

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId required" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["pending", "in_progress", "done"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify task belongs to user
    const { data: task, error: fetchError } = await supabase
      .from("daily_tasks")
      .select("id, user_id, status")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Build update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (status) {
      updates.status = status;
      // When marking as done, set completed_at
      if (status === "done") {
        updates.completed_at = new Date().toISOString();
      }
      // When un-completing, clear completed_at
      if (status !== "done" && task.status === "done") {
        updates.completed_at = null;
      }
      // When starting, set started_at if not already set
      if (status === "in_progress") {
        const { data: fullTask } = await supabase
          .from("daily_tasks")
          .select("started_at")
          .eq("id", taskId)
          .single();
        if (!fullTask?.started_at) {
          updates.started_at = new Date().toISOString();
        }
      }
    }
    if (actual_minutes !== undefined) {
      updates.actual_minutes = actual_minutes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update. Provide status or actual_minutes." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("daily_tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Integration PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ updated: true, taskId, ...updates });
  } catch (err) {
    console.error("Integration PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== DELETE: タスク削除 =====

export async function DELETE(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "TASKMA_USER_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { taskId } = body as { taskId: string };

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify task belongs to user before deleting
    const { data: task, error: fetchError } = await supabase
      .from("daily_tasks")
      .select("id, user_id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Integration DELETE error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true, taskId });
  } catch (err) {
    console.error("Integration DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
