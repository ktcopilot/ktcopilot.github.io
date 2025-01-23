require 'json'

module Jekyll
  class PostsJsonGenerator < Generator
    safe true
    priority :low

    def generate(site)
      posts_data = site.posts.docs.map do |post|
        {
          'title' => post.data['title'],
          'url' => post.url,
          'category' => post.data['categories']&.first,
          'content' => post.content.gsub(/<\/?[^>]*>/, "").gsub(/\s+/, " ").strip[0..500]
        }
      end

      File.write('_site/posts.json', JSON.pretty_generate({ 'posts' => posts_data }))
    end
  end
end 