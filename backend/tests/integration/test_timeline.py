"""Integration tests for timeline endpoints."""

from datetime import datetime, timezone

from app.models import TimelineEvent


class TestCreateEvent:
    def test_create_event(self, auth_client, project):
        response = auth_client.post(
            f"/api/timeline/{project.id}/events",
            params={
                "title": "Meeting",
                "description": "Team sync",
                "start_time": "2026-05-01T10:00:00+00:00",
                "end_time": "2026-05-01T11:00:00+00:00",
                "is_team_event": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Meeting"
        assert data["description"] == "Team sync"
        assert data["is_team_event"] is True

    def test_create_event_minimal(self, auth_client, project):
        response = auth_client.post(
            f"/api/timeline/{project.id}/events",
            params={"title": "Quick standup"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Quick standup"
        assert "start_time" in data

    def test_create_event_project_not_found(self, auth_client):
        response = auth_client.post(
            "/api/timeline/nonexistent/events",
            params={"title": "Meeting"},
        )
        assert response.status_code == 404

    def test_create_event_not_member(self, auth_client, db):
        from tests.conftest import create_test_user
        from app.models import Team, Project
        other_user = create_test_user(db, email="other6@example.com", password="pass123")
        other_team = Team(name="Other Team", owner_id=other_user.id, invite_code="other6")
        db.add(other_team)
        db.commit()
        db.refresh(other_team)
        other_project = Project(team_id=other_team.id, name="Other Project")
        db.add(other_project)
        db.commit()
        db.refresh(other_project)

        response = auth_client.post(
            f"/api/timeline/{other_project.id}/events",
            params={"title": "Meeting"},
        )
        assert response.status_code == 403


class TestListEvents:
    def test_list_events(self, auth_client, project, db, test_user):
        event = TimelineEvent(
            project_id=project.id,
            user_id=test_user.id,
            title="Event 1",
            start_time=datetime(2026, 5, 1, 10, 0, 0, tzinfo=timezone.utc),
        )
        db.add(event)
        db.commit()

        response = auth_client.get(f"/api/timeline/{project.id}/events")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Event 1"
        assert "start_time" in data[0]

    def test_list_events_empty(self, auth_client, project):
        response = auth_client.get(f"/api/timeline/{project.id}/events")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_events_ordered(self, auth_client, project, db, test_user):
        e1 = TimelineEvent(
            project_id=project.id,
            user_id=test_user.id,
            title="Later",
            start_time=datetime(2026, 5, 2, 10, 0, 0, tzinfo=timezone.utc),
        )
        e2 = TimelineEvent(
            project_id=project.id,
            user_id=test_user.id,
            title="Earlier",
            start_time=datetime(2026, 5, 1, 10, 0, 0, tzinfo=timezone.utc),
        )
        db.add_all([e1, e2])
        db.commit()

        response = auth_client.get(f"/api/timeline/{project.id}/events")
        data = response.json()
        assert data[0]["title"] == "Earlier"
        assert data[1]["title"] == "Later"


class TestDeleteEvent:
    def test_delete_own_event(self, auth_client, project, db, test_user):
        event = TimelineEvent(
            project_id=project.id,
            user_id=test_user.id,
            title="To delete",
            start_time=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        response = auth_client.delete(f"/api/timeline/{project.id}/events/{event.id}")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_other_user_event(self, auth_client, project, db):
        from tests.conftest import create_test_user
        other_user = create_test_user(db, email="other7@example.com", password="pass123")
        from app.models import TeamMember
        member = TeamMember(team_id=project.team_id, user_id=other_user.id, role="member")
        db.add(member)
        db.commit()

        event = TimelineEvent(
            project_id=project.id,
            user_id=other_user.id,
            title="Other event",
            start_time=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        response = auth_client.delete(f"/api/timeline/{project.id}/events/{event.id}")
        assert response.status_code == 403
        assert "Can only delete your own events" in response.json()["detail"]

    def test_delete_event_not_found(self, auth_client, project):
        response = auth_client.delete(f"/api/timeline/{project.id}/events/nonexistent")
        assert response.status_code == 404
