import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Rider } from '@/types/rider';
import { RIDING_LEVELS, levelLabel, ageGroupLabel, formatDate } from '@/types/rider';
import { Search, Plus, Filter, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const PAGE_SIZE = 12;

export default function RidersListPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [juniorFilter, setJuniorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const isStaff = hasRole('owner') || hasRole('school_manager') || hasRole('receptionist') || hasRole('instructor');

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    setError('');

    let query = supabase
      .from('riders')
      .select('id, member_id, full_name, date_of_birth, gender, riding_level, preferred_discipline, height_cm, weight_kg, goals, photo_url, status, is_junior, member:member_id(id, full_name, member_number, email, phone, membership_status, branch_id)', { count: 'exact' })
      .is('deleted_at', null);

    if (search.trim()) {
      query = query.ilike('full_name', `%${search.trim()}%`);
    }
    if (levelFilter) {
      query = query.eq('riding_level', levelFilter);
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (juniorFilter === 'junior') {
      query = query.eq('is_junior', true);
    } else if (juniorFilter === 'adult') {
      query = query.eq('is_junior', false);
    }

    query = query.order('full_name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, error: err, count } = await query;

    if (err) {
      setError(err.message);
      setRiders([]);
    } else {
      setRiders((data || []) as unknown as Rider[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [search, levelFilter, statusFilter, juniorFilter, page]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchRiders();
  };

  const clearFilters = () => {
    setSearch('');
    setLevelFilter('');
    setStatusFilter('');
    setJuniorFilter('');
    setPage(0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.riders')}</h1>
        </div>
        {isStaff && (
          <button
            onClick={() => navigate('/riders/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rider
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full ps-10 pe-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-cream-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors">
            {t('common.search')}
          </button>
        </form>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-cream-200">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Riding Level</label>
              <select
                value={levelFilter}
                onChange={(e) => { setLevelFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All levels</option>
                {RIDING_LEVELS.map((l) => (
                  <option key={l} value={l}>{levelLabel(l)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Age Group</label>
              <select
                value={juniorFilter}
                onChange={(e) => { setJuniorFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All ages</option>
                <option value="junior">Junior (under 18)</option>
                <option value="adult">Adult (18+)</option>
              </select>
            </div>
            {(levelFilter || statusFilter || juniorFilter) && (
              <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 self-end">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : riders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('common.noResults')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {riders.map((rider) => (
              <button
                key={rider.id}
                onClick={() => navigate(`/riders/${rider.id}`)}
                className="bg-white rounded-xl border border-cream-200 p-4 text-start hover:border-primary-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  {rider.photo_url ? (
                    <img src={rider.photo_url} alt={rider.full_name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 text-sm font-medium">
                        {rider.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{rider.full_name}</h3>
                    <p className="text-xs text-gray-500">{formatDate(rider.date_of_birth)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                        {levelLabel(rider.riding_level)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        rider.is_junior ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {ageGroupLabel(rider.is_junior)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-cream-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-cream-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
