import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function usePosts(user: User | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Load posts from localStorage or Supabase
  useEffect(() => {
    const loadPosts = async () => {
      try {
        if (user) {
          // Load from Supabase if user is logged in
          const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          setPosts(data || []);

          // Sync any local posts to Supabase
          const localPosts = JSON.parse(localStorage.getItem('posts') || '[]');
          if (localPosts.length) {
            const formatted = localPosts.map((p: Post) => ({
              user_id: user.id,
              ...p
            }));
            await supabase.from('posts').insert(formatted);
            localStorage.removeItem('posts');
          }
        } else {
          // Load from localStorage if not logged in
          const localPosts = JSON.parse(localStorage.getItem('posts') || '[]');
          setPosts(localPosts);
        }
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [user]);

  const savePost = async (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (user) {
        // Save to Supabase
        const { data, error } = await supabase
          .from('posts')
          .insert([{ user_id: user.id, ...post }])
          .select()
          .single();

        if (error) throw error;
        setPosts(prev => [data, ...prev]);
      } else {
        // Save to localStorage
        const newPost = {
          id: crypto.randomUUID(),
          ...post,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const saved = JSON.parse(localStorage.getItem('posts') || '[]');
        saved.unshift(newPost);
        localStorage.setItem('posts', JSON.stringify(saved));
        setPosts(saved);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  };

  return { posts, loading, savePost };
}