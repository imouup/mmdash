"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";

interface Team {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  is_team_event: boolean;
}

export default function TimelinePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isTeamEvent, setIsTeamEvent] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchProjects(selectedTeam);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedProject) {
      fetchEvents(selectedProject);
    }
  }, [selectedProject]);

  const fetchTeams = async () => {
    try {
      const res = await api.get("/teams");
      setTeams(res.data);
      if (res.data.length > 0 && !selectedTeam) {
        setSelectedTeam(res.data[0].id);
      }
    } catch {
      setTeams([]);
    }
  };

  const fetchProjects = async (teamId: string) => {
    try {
      const res = await api.get("/projects", { params: { team_id: teamId } });
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      } else {
        setSelectedProject("");
        setEvents([]);
      }
    } catch {
      setProjects([]);
      setSelectedProject("");
      setEvents([]);
    }
  };

  const fetchEvents = async (projectId: string) => {
    try {
      const res = await api.get(`/timeline/${projectId}/events`);
      setEvents(res.data);
    } catch {
      setEvents([]);
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await api.post(`/timeline/${selectedProject}/events`, null, {
        params: {
          title,
          description,
          start_time: startTime,
          end_time: endTime || undefined,
          is_team_event: isTeamEvent,
        },
      });
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
      setIsTeamEvent(false);
      fetchEvents(selectedProject);
      setMessage("日程添加成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "添加失败");
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!selectedProject) return;
    try {
      await api.delete(`/timeline/${selectedProject}/events/${eventId}`);
      fetchEvents(selectedProject);
      setMessage("日程已删除");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "删除失败");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN");
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">时间线</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">选择项目</h2>
            <div className="space-y-2 mb-4">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeam(t.id)}
                  className={`w-full text-left border p-3 rounded transition-colors ${
                    selectedTeam === t.id ? "border-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  className={`w-full text-left border p-3 rounded transition-colors ${
                    selectedProject === p.id ? "border-green-500 bg-green-50" : ""
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">添加日程</h2>
            <form onSubmit={createEvent} className="space-y-3">
              <input
                type="text"
                placeholder="标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
              <textarea
                placeholder="描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
              <div>
                <label className="block text-sm font-medium mb-1">开始时间</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">结束时间（可选）</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isTeamEvent}
                  onChange={(e) => setIsTeamEvent(e.target.checked)}
                />
                团队日程
              </label>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                添加
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">日程表</h2>
            {events.length === 0 ? (
              <p className="text-gray-500">暂无日程</p>
            ) : (
              <div className="space-y-4">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="border-l-4 border-blue-500 pl-4 py-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-lg">{evt.title}</div>
                        {evt.description && (
                          <div className="text-gray-600 text-sm mt-1">{evt.description}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-2">
                          {formatDate(evt.start_time)}
                          {evt.end_time && ` ~ ${formatDate(evt.end_time)}`}
                        </div>
                        {evt.is_team_event && (
                          <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            团队
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteEvent(evt.id)}
                        className="text-red-500 text-sm hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
