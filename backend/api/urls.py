from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'cards/master', views.CardMasterViewSet, basename='cardmaster')
router.register(r'listings', views.CardListingViewSet, basename='card-listing')
router.register(r'orders', views.OrderViewSet, basename='order')

urlpatterns = [
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    path('auth/allauth/', include('allauth.urls')),
] + router.urls + [
    path('user/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('cards/list/', views.CardMasterListAPIView.as_view(), name='card-list'),
    path('cards/<str:api_id>/', views.CardMasterDetailAPIView.as_view(), name='card-detail'),
    path('cards/<str:api_id>/stats/', views.CardDetailWithStatsAPIView.as_view(), name='card-stats'),
    path('sets/', views.SetListAPIView.as_view(), name='set-list'),
    path('stats/', views.DatabaseStatsAPIView.as_view(), name='db-stats'),
    path('', views.api_root, name='api-root'),
]
