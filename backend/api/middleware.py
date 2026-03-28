"""
Custom middleware to exempt API endpoints from CSRF protection.
Since we're using JWT authentication, CSRF is not needed for API calls.
"""
from django.utils.deprecation import MiddlewareMixin


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Disable CSRF protection for API endpoints.
    This is safe because we use JWT authentication instead.
    """
    def process_request(self, request):
        # Exempt all /api/ endpoints from CSRF
        if request.path.startswith('/api/'):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None
